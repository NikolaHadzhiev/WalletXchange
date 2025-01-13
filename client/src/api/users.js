import { axiosInstance } from ".";

// login user
export const LoginUser = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/users/login", payload);
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
    const { data } = await axiosInstance.post("/api/users/register", payload);
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