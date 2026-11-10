import Image from 'next/image';

/** Use the official CDN artwork unchanged, including its original colours. */
export default function CityPayLogo({ className }: { className: string }) {
  return (
    <Image
      src="https://cdn.citypay.com/citypay-logo.svg"
      alt="CityPay"
      width={137}
      height={40}
      className={className}
      unoptimized
    />
  );
}
