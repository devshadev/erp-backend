export const createAuthError = (message) => {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
};

export const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  active: user.active,
  createdBy: user.createdBy
    ? typeof user.createdBy === "object"
      ? user.createdBy._id
      : user.createdBy
    : null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastLogin: user.lastLogin,
});
