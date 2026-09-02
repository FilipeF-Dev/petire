import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Renova a sessão do Supabase a cada request e faz o redirecionamento
 * otimista das áreas logadas.
 *
 * Isto é só um filtro barato. A autorização de verdade (existe manager? de qual
 * loja?) fica em src/lib/auth.ts, chamada pelos layouts — o proxy pode ser
 * contornado, um Server Component não.
 */
export async function proxy(request: NextRequest) {
  // O Supabase pode emitir cookies novos durante o refresh do token. Guardamos
  // aqui para conseguir colá-los tanto numa resposta normal quanto num redirect
  // — um NextResponse.redirect criado depois não herdaria esses cookies.
  const pendingCookies: {
    name: string;
    value: string;
    options: Record<string, unknown>;
  }[] = [];
  const pendingHeaders: Record<string, string> = {};

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          pendingCookies.push(cookie);
        }
        Object.assign(pendingHeaders, headers);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const withSession = (response: NextResponse) => {
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }
    for (const [key, value] of Object.entries(pendingHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  };

  const path = request.nextUrl.pathname;
  const isLoginPage = path === "/entrar";
  const isProtected = path.startsWith("/gerente") || path.startsWith("/admin");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    url.searchParams.set("next", path);
    return withSession(NextResponse.redirect(url));
  }

  if (isLoginPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/gerente";
    url.search = "";
    return withSession(NextResponse.redirect(url));
  }

  return withSession(NextResponse.next({ request }));
}

export const config = {
  matcher: [
    // Tudo, menos os assets estáticos — rodar o proxy neles gasta uma chamada
    // de auth por imagem.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|webmanifest)$).*)",
  ],
};
