import { useState } from "react";
import "../styles/catalog-skeleton.css";

export default function ProductPhoto({ src, alt, className, loading }) {
  const [pending, setPending] = useState(true);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        onLoad={() => setPending(false)}
        onError={() => setPending(false)}
      />
      {src && pending && (
        <span className="catalog-skeleton catalog-skeleton--photo" aria-hidden="true" />
      )}
    </>
  );
}
