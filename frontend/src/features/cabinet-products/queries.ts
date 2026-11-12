import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBrandProduct,
  getBrandProducts,
  uploadImage,
} from "../../api/client";
import type { CardFormValues } from "../../shared/validation";
import { toCreateProductRequest } from "./cardForm";

const brandProductsKey = ["brand", "products"] as const;

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
