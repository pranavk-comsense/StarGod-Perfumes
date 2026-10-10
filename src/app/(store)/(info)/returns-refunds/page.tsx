import { InfoPageView, infoMetadata } from "@/components/store/info-page";

export const metadata = infoMetadata("returns-refunds");

export default function Page() {
  return <InfoPageView slug="returns-refunds" />;
}
