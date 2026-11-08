import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/akun")({
  beforeLoad: () => {
    throw redirect({ to: "/profil" });
  },
  component: () => <Navigate to="/profil" />,
});
