import { InfoPageView, infoMetadata } from "@/components/store/info-page";

export const metadata = infoMetadata("terms");

export default function Page() {
  return <InfoPageView slug="terms" />;
}
