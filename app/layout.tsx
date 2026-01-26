import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata = { title: "PostNord-Cup" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <NavBar />
        <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">
          {children}
        </main>
      </body>
    </html>
  );
}