import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBrandProduct,
  getBrandProducts,
  publishBrandProducts,
  updateBrandProduct,
  uploadImage,
} from "../../api/client";
import type { BrandCard } from "../../api/types";
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
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: brandProductsKey }),
  });
}
