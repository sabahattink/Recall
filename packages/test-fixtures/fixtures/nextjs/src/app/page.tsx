import { getFeaturedProducts } from '@/lib/products';

export default async function HomePage() {
  const products = await getFeaturedProducts();
  return (
    <main>
      <h1>Featured products</h1>
      <ul>
        {products.map((product) => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </main>
  );
}
