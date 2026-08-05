import { useEffect } from "react";

function WebsiteRedirect() {
  useEffect(() => {
    window.location.href = "http://localhost:5174/";
  }, []);

  return null;
}

export default WebsiteRedirect;