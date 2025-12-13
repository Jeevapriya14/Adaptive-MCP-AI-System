export const getSessionId = () => {
  let sid = localStorage.getItem("session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("session_id", sid);
  }
  return sid;
};

export const getUserEmail = () => {
  return localStorage.getItem("user_email");
};

export const setUserEmail = (email) => {
  localStorage.setItem("user_email", email);
};
