"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/components/tenant/TenantProvider";
import { greetingForHour } from "../greeting";


// Begrüßung nach der LOKALEN Uhrzeit des Browsers. Der Server liefert einen
// Startwert (deutsche Zeit), damit beim ersten Rendern nichts springt; nach dem
// Mount wird mit der Gerätezeit nachgezogen und jede Minute aktualisiert.
// Im Impersonations-Modus steht statt des eigenen Vornamens der geöffnete Kunde.
export default function DashboardGreeting({
  initialGreeting,
  firstName,
}: {
  initialGreeting: string;
  firstName: string | null;
}) {
  const { tenant, isImpersonating } = useTenant();
  const [greeting, setGreeting] = useState(initialGreeting);

  useEffect(() => {
    const update = () => setGreeting(greetingForHour(new Date().getHours()));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);

  const name = isImpersonating ? tenant.name : firstName;

  return (
    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
      {greeting}
      {name ? `, ${name}` : ""} 👋
    </h1>
  );
}
