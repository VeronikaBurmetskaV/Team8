import { useRef } from "react";
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createBrandProduct,
  getBrandProducts,
  publishBrandProduct,
  uploadImage,
} from "../../api/client";
import type { BrandCard } from "../../api/types";
import { brandProfileQueryKey } from "../../shared/brandProfile";
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

const publishKey = ["brand", "products", "publish"] as const;

/**
 * Draft → Published (US-31 S1). The server is the only gate (ADR-0009); the disabled button
 * while a request runs is UX only.
 */
export function usePublishBrandProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: publishKey,
    mutationFn: (id: string) => publishBrandProduct(id),
    onSuccess: (published) => {
      // Same place in the list; the refetch then updates the counters on /brand too.
      queryClient.setQueryData<BrandCard[]>(brandProductsKey, (cards) =>
        cards?.map((card) => (card.id === published.id ? published : card)),
      );
      return queryClient.invalidateQueries({ queryKey: brandProductsKey });
    },
    onError: (error) => {
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
  });
}

/** IDs of the cards whose publish request is still running (one row may wait, others not). */
export function usePublishingIds(): string[] {
  return useMutationState({
    filters: { mutationKey: publishKey, status: "pending" },
    select: (mutation) => mutation.state.variables as string,
  });
}
