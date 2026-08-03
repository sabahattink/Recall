export interface Product {
  id: string;
  name: string;
}

export async function getFeaturedProducts(): Promise<Product[]> {
  return [{ id: '1', name: 'Recall CLI license' }];
}
