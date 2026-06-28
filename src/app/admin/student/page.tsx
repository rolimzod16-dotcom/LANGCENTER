import { redirect } from "next/navigation";

export default function AdminStudentRedirect() {
  redirect("/admin/students");
}