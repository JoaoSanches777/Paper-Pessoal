import Image from "next/image";

export function Logo({ className = "", heightClass = "h-8" }: { className?: string; heightClass?: string }) {
  return (
    <Image
      src="/logo-nyc-digital.png"
      alt="NYC Digital"
      width={816}
      height={208}
      className={`${heightClass} w-auto block ${className}`}
      priority
      unoptimized
    />
  );
}
