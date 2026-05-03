// @ts-ignore – Radix Themes global CSS
import "@radix-ui/themes/styles.css";
// @ts-ignore – CSS module side-effect imports
import "./globals.css";
// @ts-ignore – CSS module side-effect imports
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import { Geist, JetBrains_Mono } from "next/font/google";
import { Theme } from "@radix-ui/themes";
import { cn } from "@/src/lib/utils";
import AppShell from "@/src/components/AppShell";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});
const jetbrains = JetBrains_Mono({subsets:['latin'],variable:'--font-mono'});

export const metadata = {
  title: "Video Lab",
  description: "剧情 -> 镜头 -> 首尾帧 -> 视频",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={cn("font-sans", geist.variable, jetbrains.variable)}>
      <body>
        <Theme appearance="dark" accentColor="cyan" grayColor="slate" radius="large" panelBackground="solid">
          <AppShell>{children}</AppShell>
          <ToastContainer
            position="top-right"
            autoClose={4000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            pauseOnHover
            theme="dark"
          />
        </Theme>
      </body>
    </html>
  );
}
