import { asyncHandler } from "../utils/asynchandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        // add refresh token to database which is in user.module.js
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async (req,res) => {
    //steps :-
    // 1 - get details of user from frontend (req body -> data)
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
    const existedUser = await User.findOne({
        $or : [{username}, {email}]
    })
    if(existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    //console.log(req.files);

    //step - 4:
    const avatarlocalPath = req.files?.avatar[0]?.path
    //const coverImagelocalPath = req.files?.coverImage[0]?.path
    let coverImagelocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImagelocalPath = req.files.coverImage[0].path
    }

    if(!avatarlocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    //step - 5:
    const avatar = await uploadOnCloudinary(avatarlocalPath)
    const coverImage = await uploadOnCloudinary(coverImagelocalPath)

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

const loginUser = asyncHandler(async (req,res) => {
    // req body -> data
    // username or email
    // find the user
    // password check
    // accesss and refresh token
    // send cookie
    // return res

    // step - 1 :
    const {email,username,password} = req.body
    if(!username || !email) {
        throw new ApiError(400,"username or email is required")
    }

    // step - 2 :
    const user = await User.findOne({
        $or: [{username},{email}]
    })

    // step - 3 :
    if(!user) {
        throw new ApiError(404, "user doesnot exist")
    }

    // step - 4:
    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid) {
        throw new ApiError(401,"Invalid User Credentials")
    }

    // step - 5 :
    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // step - 6 :
    const options = {
        httpOnly: true,
        secure: true
    }

    // step - 7 :
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In successfully"
        )
    )
})

const logoutUser = asyncHandler(async (req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true  // this gives a new response which willl return a true value i.e the refresh token will give a undefined value. If this field is not written there can be a chance of getting the refresh token again.
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200, "User logged out"))
})

export {
    registerUser,
    loginUser,
    logoutUser
}