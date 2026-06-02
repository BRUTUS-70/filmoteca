// src/middleware.ts
import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const protectedRoutes = ['/dashboard', '/admin', '/deseos', '/ajustes'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect } = context;
  
  const accessToken = cookies.get("sb-access-token")?.value;
  const refreshToken = cookies.get("sb-refresh-token")?.value;

  const isProtectedRoute = protectedRoutes.some(route => url.pathname.startsWith(route));
  const isPublicRoute = url.pathname === '/';

  if (isProtectedRoute) {
    if (!accessToken) {
      return redirect("/");
    }

    // Inicializamos Supabase inyectando el transport de WebSockets (Fix para Node 20)
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
        },
        realtime: {
          transport: ws,
        }
      }
    );

    // En lugar de setSession, solo validamos el usuario actual
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      cookies.delete("sb-access-token", { path: '/' });
      cookies.delete("sb-refresh-token", { path: '/' });
      return redirect("/");
    }

  } else if (isPublicRoute) {
    if (accessToken) {
      // Validamos rápidamente si el token sigue vivo para saltarnos el login
      const supabase = createClient(
        import.meta.env.PUBLIC_SUPABASE_URL,
        import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
        { 
          auth: { 
            persistSession: false 
          },
          realtime: {
            transport: ws,
          }
        }
      );
      const { data } = await supabase.auth.getUser(accessToken);
      if (data.user) {
        return redirect("/dashboard");
      }
    }
  }

  return next();
});
