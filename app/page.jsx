import PmsApp from "@/components/PmsApp";
import AuthGate from "@/components/AuthGate";

export default function Page() {
  return (
    <AuthGate>
      <PmsApp />
    </AuthGate>
  );
}
