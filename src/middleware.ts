import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/login",
  },
})

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/items/:path*",
    "/stocktake/:path*",
    "/scan/:path*",
    "/reports/:path*",
  ],
}
