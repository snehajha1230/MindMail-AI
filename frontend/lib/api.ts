export async function sendMessage(
  backendUrl: string,
  token: string,
  message: string
) {
  const res = await fetch(`${backendUrl}/chatbot/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    throw new Error("Failed to send message");
  }

  return res.json();
}

export async function fetchLatestEmails(
  backendUrl: string,
  token: string
) {
  const res = await fetch(`${backendUrl}/gmail/latest`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch emails");
  }

  return res.json();
}

export async function deleteEmail(
  backendUrl: string,
  token: string,
  emailId: string
) {
  const res = await fetch(`${backendUrl}/gmail/delete/${emailId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to delete email" }));
    throw new Error(error.detail || "Failed to delete email");
  }

  return res.json();
}

export async function getEmailById(
  backendUrl: string,
  token: string,
  emailId: string
) {
  const res = await fetch(`${backendUrl}/gmail/email/${emailId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to fetch email" }));
    throw new Error(error.detail || "Failed to fetch email");
  }

  return res.json();
}

export async function replyToEmail(
  backendUrl: string,
  token: string,
  emailId: string,
  replyText: string
) {
  const res = await fetch(`${backendUrl}/gmail/reply/${emailId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reply_text: replyText }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to send reply" }));
    throw new Error(error.detail || "Failed to send reply");
  }

  return res.json();
}

export async function getGreeting(backendUrl: string, token: string) {
  const res = await fetch(`${backendUrl}/chatbot/greeting`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to get greeting");
  }

  return res.json();
}

export async function confirmAction(
  backendUrl: string,
  token: string,
  action: string,
  emailId: string | null,
  replyText: string | null,
  confirmation: string
) {
  const res = await fetch(`${backendUrl}/chatbot/confirm-action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action,
      email_id: emailId,
      reply_text: replyText,
      confirmation,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Failed to confirm action" }));
    throw new Error(error.detail || "Failed to confirm action");
  }

  return res.json();
}

export async function getUserProfile(backendUrl: string, token: string) {
  const res = await fetch(`${backendUrl}/auth/profile`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to get user profile");
  }

  return res.json();
}
