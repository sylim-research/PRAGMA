import { Navigate, useSearchParams } from "react-router-dom";
import { classResponsesTabPath } from "@/lib/admin/classResponsesPath";

const AdminClassResponses = () => {
  const [params] = useSearchParams();
  return <Navigate to={classResponsesTabPath(params)} replace />;
};

export default AdminClassResponses;
