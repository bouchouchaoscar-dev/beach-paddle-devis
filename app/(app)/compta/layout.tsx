import { ComptaSaisonProvider } from "./ComptaSaisonProvider";

export default function ComptaLayout({ children }: { children: React.ReactNode }) {
  return <ComptaSaisonProvider>{children}</ComptaSaisonProvider>;
}
