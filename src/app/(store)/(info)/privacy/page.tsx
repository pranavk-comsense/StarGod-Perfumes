import { InfoPageView, infoMetadata } from "@/components/store/info-page";

export const metadata = infoMetadata("privacy");

export default function Page() {
  return <InfoPageView slug="privacy" />;
}
