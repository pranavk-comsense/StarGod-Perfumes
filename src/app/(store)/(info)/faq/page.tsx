import { InfoPageView, infoMetadata } from "@/components/store/info-page";

export const metadata = infoMetadata("faq");

export default function Page() {
  return <InfoPageView slug="faq" />;
}
