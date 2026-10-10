import { InfoPageView, infoMetadata } from "@/components/store/info-page";

export const metadata = infoMetadata("shipping-policy");

export default function Page() {
  return <InfoPageView slug="shipping-policy" />;
}
