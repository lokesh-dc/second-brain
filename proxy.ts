import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const APP_PATHS = ["/home", "/search", "/insights", "/categories"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const path = request.nextUrl.pathname;
  const onboarded =
    request.cookies.get("onboarding_complete")?.value === "true";

  const { data: { user } } = await supabase.auth.getUser();

  // ---- Signed out ----
  if (!user) {
    if (APP_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (path === "/setup") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (path === "/" && onboarded) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (path === "/login" && !onboarded) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  // ---- Signed in: check setup completion ----
  let setupComplete = false;
  try {
    const { data } = await supabase
      .from("user_profiles")
      .select("setup_complete")
      .eq("id", user.id)
      .single();
    setupComplete = data?.setup_complete ?? false;
  } catch {
    setupComplete = false;
  }

  if (!setupComplete) {
    if (path !== "/setup") {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
    return response;
  }

  // ---- Fully set up: keep them in the app ----
  if (
    path === "/" ||
    path === "/login" ||
    path === "/setup"
  ) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
