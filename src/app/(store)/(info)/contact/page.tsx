import { VisitStore } from "@/components/store/visit-store";
import { InfoPageView, infoMetadata } from "@/components/store/info-page";

export const metadata = infoMetadata("contact");

export default function Page() {
  return (
    <>
      <InfoPageView slug="contact" />
      <VisitStore className="mb-4" />
    </>
  );
}
