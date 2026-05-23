import React, { useState, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AssistantSidebar } from "@/components/AssistantSidebar";

function NotFoundComponent() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <div style={{ maxWidth: 400, textAlign: "center", fontFamily: "Manrope, sans-serif" }}>
        <h1 style={{ fontSize: 64, fontWeight: 200, color: "#3059b9", margin: "0 0 16px", letterSpacing: "-0.04em" }}>404</h1>
        <p style={{ fontSize: 18, color: "#434652", margin: "0 0 24px", fontWeight: 400 }}>Страница не найдена</p>
        <Link
          to="/"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "12px 28px", borderRadius: 9999,
            background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.6)", color: "#3059b9",
            fontFamily: "Manrope, sans-serif", fontWeight: 600, fontSize: 14,
            textDecoration: "none", letterSpacing: "0.05em",
          }}
        >
          На главную
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <div style={{ maxWidth: 400, textAlign: "center", fontFamily: "Manrope, sans-serif" }}>
        <h1 style={{ fontSize: 24, fontWeight: 400, color: "#181c20", margin: "0 0 12px" }}>
          Что-то пошло не так
        </h1>
        <p style={{ fontSize: 15, color: "#434652", margin: "0 0 24px" }}>
          Попробуйте перезагрузить страницу или вернуться на главную.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => { router.invalidate(); reset(); }}
            style={{
              padding: "12px 24px", borderRadius: 9999,
              background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.6)", color: "#3059b9",
              fontFamily: "Manrope, sans-serif", fontWeight: 600, fontSize: 14,
              cursor: "pointer",
            }}
          >
            Попробовать снова
          </button>
          <a
            href="/"
            style={{
              padding: "12px 24px", borderRadius: 9999,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.5)", color: "#434652",
              fontFamily: "Manrope, sans-serif", fontWeight: 500, fontSize: 14,
              textDecoration: "none", display: "inline-flex", alignItems: "center",
            }}
          >
            На главную
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lev & Nikol" },
      { name: "description", content: "Разбор английских слов и фраз" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@200;400;500;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/** Atmospheric orb background with mouse parallax */
function AtmosphericBackground() {
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 30;
      const y = (e.clientY / window.innerHeight) * 30;

      if (orb1Ref.current) {
        orb1Ref.current.style.transform = `translate(${x * 0.4}px, ${y * 0.4}px)`;
      }
      if (orb2Ref.current) {
        orb2Ref.current.style.transform = `translate(${x * 0.8}px, ${y * 0.8}px)`;
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <>
      <div
        ref={orb1Ref}
        className="ln-orb"
        style={{ top: -150, left: -150 }}
      />
      <div
        ref={orb2Ref}
        className="ln-orb"
        style={{ bottom: -250, right: -150 }}
      />
    </>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AtmosphericBackground />
      <div className="app-with-assistant">
        <Outlet />
      </div>
      <AssistantSidebar />
    </QueryClientProvider>
  );
}
