import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function GrutaDoOcaso() {
  const configured = process.env.OCASO_ROOMS_ORIGIN?.trim() ?? "";
  const hosted = URL.parse(configured);
  const local = hosted?.protocol === "http:" && ["localhost", "127.0.0.1"].includes(hosted.hostname);
  if (hosted?.origin === configured && (hosted.protocol === "https:" || local)) {
    redirect(hosted.origin + "/");
  }
  redirect("/ocaso/index.html");
}
