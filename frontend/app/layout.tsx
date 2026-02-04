import "./globals.css";

export const metadata = {
  title: "MailMind – Email Assistant",
  description: "AI powered Gmail assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
