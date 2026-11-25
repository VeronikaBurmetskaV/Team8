import { useRef } from "react";
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  createBrandProduct,
  getBrandProducts,
  publishBrandProduct,
  publishBrandProducts,
  removeBrandProductFromList,
  unpublishBrandProduct,
  unpublishBrandProducts,
  updateBrandProduct,
  uploadImage,
} from "../../api/client";
import type { BrandCard } from "../../api/types";
import { brandProfileQueryKey } from "../../shared/brandProfile";
import { brandsQueryKey } from "../catalog/BrandTiles";
import { feedQueryKey } from "../feed/FeedPage";
import { errorCodeOf } from "../../shared/errors";
import type { CardFormValues } from "../../shared/validation";
import { toCreateProductRequest } from "./cardForm";

export const brandProductsKey = ["brand", "products"] as const;

/** The brand's own cards, newest first as the server returns them. */
export function useBrandProducts() {
  return useQuery({ queryKey: brandProductsKey, queryFn: getBrandProducts });
}

/** Uploads the chosen file (if any), then creates the draft (US-25.1). */
export function useCreateBrandProduct() {
  const queryClient = useQueryClient();
  // A retry after a failed save reuses the image that is already uploaded.
  const uploaded = useRef<{ file: File; id: string } | null>(null);

  return useMutation({
    mutationFn: async (values: CardFormValues) => {
      const file = values.photo.file;
      let photoImageId: string | null = null;
      if (file) {
        if (uploaded.current?.file !== file) {
          const image = await uploadImage(file);
          uploaded.current = { file, id: image.id };
        }
        photoImageId = uploaded.current.id;
      }
      return createBrandProduct(toCreateProductRequest(values, photoImageId));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: brandProductsKey }),
  });
}

/**
 * PUT /api/brand/products/{id} (US-26 S1). A new file is uploaded first; with neither a new
 * file nor a URL the card keeps its uploaded image (editCardFormSchema allows that).
 */
export function useUpdateBrandProduct(card: BrandCard | undefined) {
  const queryClient = useQueryClient();
  const uploaded = useRef<{ file: File; id: string } | null>(null);

  return useMutation({
    mutationFn: async (values: CardFormValues) => {
      if (card === undefined) throw new Error("No card to update");
      const file = values.photo.file;
      let photoImageId: string | null = null;
      if (file) {
        if (uploaded.current?.file !== file) {
          const image = await uploadImage(file);
          uploaded.current = { file, id: image.id };
        }
        photoImageId = uploaded.current.id;
      } else if (values.photo.url.trim() === "") {
        photoImageId = card.photoImageId;
      }
      return updateBrandProduct(
        card.id,
        toCreateProductRequest(values, photoImageId),
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: brandProductsKey }),
  });
}

/** POST /api/brand/products/publish (ADR-0017): many drafts at once, same consent gate. */
export function usePublishBrandProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => publishBrandProducts(ids),
    onSuccess: () => refreshAfterPublishChange(queryClient),
    onError: (error) => {
      // Partly applied or refused by the consent gate: read the list (and consent) again.
      void refreshAfterPublishChange(queryClient);
      if (errorCodeOf(error) === "CONSENT_REQUIRED") {
        void queryClient.invalidateQueries({ queryKey: brandProfileQueryKey });
      }
    },
  });
}

const publishKey = ["brand", "products", "publish"] as const;

/**
 * Draft → Published (US-31 S1). The server is the only gate (ADR-0009); the disabled button
 * while a request runs is UX only.
 */
export function usePublishBrandProduct() {
  return useMutation(publishOneOptions(useQueryClient()));
}

/** The options of usePublishBrandProduct, exported for the tests (no DOM in Vitest). */
export function publishOneOptions(queryClient: QueryClient) {
  return {
    mutationKey: publishKey,
    mutationFn: (id: string) => publishBrandProduct(id),
    onSuccess: (published: BrandCard) => {
      // Same place in the list; the refetch then updates the counters on /brand too.
      queryClient.setQueryData<BrandCard[]>(brandProductsKey, (cards) =>
        cards?.map((card) => (card.id === published.id ? published : card)),
      );
      return refreshAfterPublishChange(queryClient);
    },
    onError: (error: unknown) => {
      const code = errorCodeOf(error);
      // The card or the consent changed elsewhere: read them again (api.md §3.2).
      if (
        code === "INVALID_STATE" ||
        code === "NOT_FOUND" ||
        code === "CONSENT_REQUIRED"
      ) {
        void queryClient.invalidateQueries({ queryKey: brandProductsKey });
      }
      if (code === "CONSENT_REQUIRED") {
        void queryClient.invalidateQueries({ queryKey: brandProfileQueryKey });
      }
    },
  };
}

/** IDs of the cards whose publish request is still running (one row may wait, others not). */
export function usePublishingIds(): string[] {
  return useMutationState({
    filters: { mutationKey: publishKey, status: "pending" },
    select: (mutation) => mutation.state.variables as string,
  });
}

const removeKey = ["brand", "products", "remove-from-list"] as const;

/** «Прибрати зі списку» (ADR-0017): the card leaves the list after the refetch. */
export function useRemoveFromList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: removeKey,
    mutationFn: (id: string) => removeBrandProductFromList(id),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: brandProductsKey }),
  });
}

/** IDs of the cards whose «Прибрати зі списку» is still running. */
export function useRemovingIds(): string[] {
  return useMutationState({
    filters: { mutationKey: removeKey, status: "pending" },
    select: (mutation) => mutation.state.variables as string,
  });
}

/**
 * After a publish, an unpublish or a site sync: the cabinet list, and what buyers see in this
 * browser — the feed (swipes, catalogue, «Вподобане») and the brand tiles (a brand appears with
 * its first published card and disappears with its last) — without a reload.
 */
export function refreshAfterPublishChange(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: brandProductsKey }),
    queryClient.invalidateQueries({ queryKey: feedQueryKey }),
    queryClient.invalidateQueries({ queryKey: brandsQueryKey }),
  ]);
}

const unpublishKey = ["brand", "products", "unpublish"] as const;

/** «Зняти з публікації» of one card (US-31 CL, T-4); asked first with ConfirmDialog. */
export function useUnpublishBrandProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: unpublishKey,
    mutationFn: (id: string) => unpublishBrandProduct(id),
    onSuccess: (card) => {
      // Same place in the list at once: «Чернетка» and «Опублікувати у стрічку».
      queryClient.setQueryData<BrandCard[]>(brandProductsKey, (cards) =>
        cards?.map((each) => (each.id === card.id ? card : each)),
      );
      return refreshAfterPublishChange(queryClient);
    },
    onError: () =>
      queryClient.invalidateQueries({ queryKey: brandProductsKey }),
  });
}

/** IDs of the cards whose «Зняти з публікації» is still running. */
export function useUnpublishingIds(): string[] {
  return useMutationState({
    filters: { mutationKey: unpublishKey, status: "pending" },
    select: (mutation) => mutation.state.variables as string,
  });
}

/** «Зняти вибрані з публікації»: POST /api/brand/products/unpublish. */
export function useUnpublishBrandProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => unpublishBrandProducts(ids),
    onSettled: () => refreshAfterPublishChange(queryClient),
  });
}
