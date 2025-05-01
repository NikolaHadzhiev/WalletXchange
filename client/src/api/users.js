import { axiosInstance } from ".";

// login user
export const LoginUser = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/users/login", payload, { withCredentials: true });
    return data;
  } catch (error) {

    if(!error.response) {
      return { message: "Server error" };
    }

    return error.response.data;
  }
};

// register user
export const RegisterUser = async (payload) => {
  try {
    // Ensure all form values are proper strings to prevent server-side trim() errors
    const sanitizedPayload = {};
    for (const key in payload) {
      sanitizedPayload[key] = payload[key] !== undefined && payload[key] !== null 
        ? String(payload[key])
        : "";
    }
    
    const { data } = await axiosInstance.post("/api/users/register", sanitizedPayload);
    return data;
  } catch (error) {
    if(!error.response) {
      return { success: false, message: "Server error" };
    }
    return error.response.data;
  }
};

// login user
export const RefreshToken = async () => {
  try {
    const { data } = await axiosInstance.post("/api/users/refresh-token", null, { withCredentials: true });
    return data;
  } catch (error) {

    if(!error.response) {
      return { message: "Server error" };
    }

    return error.response.data;
  }
};

//enable 2FA
export const Enable2FA = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/users/enable-2fa", payload);
    return data;
  } catch (error) {
    if(!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
};

//check 2FA status
export const Check2FAStatus = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/users/check-2fa", payload);
    return data;
  } catch (error) {
    if(!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
};

//verify 2FA
export const Verify2FA = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/users/verify-2fa", payload);
    return data;
  } catch (error) {
    if(!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
};

//disable 2FA
export const Disable2FA = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/users/disable-2fa", payload);
    return data;
  } catch (error) {
    if (!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
};

// Admin disables 2FA for a user
export const AdminDisable2FA = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/users/admin-disable-2fa", payload);
    return data;
  } catch (error) {
    if (!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
};

// get user info
export const GetUserInfo = async () => {
  try {

    const { data } = await axiosInstance.post("/api/users/get-user-info");

    return data
  } catch(error) {
    if(!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
}

// get all users
export const GetAllUsers = async () => {
  try {
    const { data } = await axiosInstance.get("/api/users/get-all-users");

    return data;
  } catch (error) {
    if(!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
}

// Update user verified status
export const UpdateUserVerifiedStatus = async (payload) => {
  try {
    const { data } = await axiosInstance.post(
      "/api/users/update-user-verified-status",
      payload
    );
    
    return data;
  } catch (error) {
    if(!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
}

//Request user delete
export const RequestUserDelete = async (payload) => {
  try {

    const { data } = await axiosInstance.post(
      "/api/users/request-delete",
      payload
    );

    return data;
  }
  catch (error) {
    if(!error.response) {
      return { message: "Server error" };
    }
    return error.response.data
  }
}

export const DeleteUser = async (payload) => {
  try {

    const { data } = await axiosInstance.delete(
      `/api/users/delete-user/${payload._id}`,
    );

    return data;
  }
  catch (error) {
    if(!error.response) {
      return { message: "Server error" };
    }
    return error.response.data
  }
}

// Edit user (admin only)
export const EditUser = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/users/edit-user", payload);
    return data;
  } catch (error) {
    if (!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
};