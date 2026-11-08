import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ulasan")({
  beforeLoad: () => {
    throw redirect({ to: "/profil", search: { tab: "ulasan" } });
  },
  component: () => <Navigate to="/profil" search={{ tab: "ulasan" }} />,
});
