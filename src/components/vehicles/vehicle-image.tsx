"use client";

import Image from "next/image";
import * as React from "react";

export type VehicleImageProps = {
  src?: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  placeholder?: "empty" | "blur";
  blurDataURL?: string;
};

const FALLBACK = "/images/vehicles/default-vehicle.svg";

export function VehicleImage({ src, alt, width, height, className, priority, placeholder, blurDataURL }: VehicleImageProps) {
  const [imgSrc, setImgSrc] = React.useState<string>(src && src.trim() !== "" ? src : FALLBACK);

  React.useEffect(() => {
    setImgSrc(src && src.trim() !== "" ? src : FALLBACK);
  }, [src]);

  return (
    <Image
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      placeholder={placeholder}
      blurDataURL={blurDataURL}
      onError={() => setImgSrc(FALLBACK)}
    />
  );
}
