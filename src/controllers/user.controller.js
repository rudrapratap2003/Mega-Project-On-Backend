import { asyncHandler } from "../utils/asynchandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req,res) => {
    //steps :-
    // 1 - get details of user from frontend
    // 2 - validation - not empty
    // 3 - check if user already exists : username, email
    // 4 - check for images, check for avatar
    // 5 - upload them to cloudinary, check for avatar
    // 6 - create user object - create entry in db
    // 7 - remove password and refresh token field from response
    // 8 - check for user creation
    // 9 - return res

    //step - 1:
    const {fullName, email, username, password} = req.body
    //console.log("email: ",email);
    

    // step - 2:

    // if(fullName === "" ){
    //     throw new ApiError(400,"fullname is required")
    // }
    if([fullName, email, username, password].some((field) => field ?.trim() ==="")) {
        throw new ApiError(400, "All fields are required")
    }

    // step - 3:
    const existedUser = User.findOne({
        $or : [{username}, {email}]
    })
    if(existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    //step - 4:
    const avatarlocalPath = req.files?.avatar[0]?.path
    const coverImagelocalPath = req.files?.coverImage[0]?.path

    if(!avatarlocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    //step - 5:
    const avatar = await uploadOnCloudinary(avatarlocalPath)
    const coverImage = await uploadOnCloudinary(coverImagelocalPathlocalPath)

    if(!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    //step - 6:
    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    //step - 7:
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //step - 8:
    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // step - 9:
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered successfully")
    )
})
export {registerUser}