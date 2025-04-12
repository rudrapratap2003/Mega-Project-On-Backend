import { asyncHandler } from "../utils/asynchandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

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
    if(!(username || email)) {
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
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true  // this gives a new response which will return a true value i.e the refresh token will give a undefined value. If this field is not written there can be a chance of getting the refresh token again.
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
    .json(new ApiResponse(200, {},"User logged out"))
})

const refreshAccessToken = asyncHandler(async (req,res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken) {
        throw new ApiError(401,"unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
        if(!user) {
            throw new ApiError(401,"Invalid refresh token")
        }
    
        if(incomingRefreshToken != user?.refreshToken) {
            throw new ApiError(401,"refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true, 
            secure: true
        }
    
        const {accessToken,newrefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newrefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken,newrefreshToken},
                "Access token refreshed"
            )
        )
    } catch(error) {
        throw new ApiError(401,error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async(req,res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect) {
        throw new ApiError(400,"Invalid password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(
        new ApiResponse(200,{},"Password changed successfully")
    )
})

const getCurrentUser = asyncHandler(async(req,res) => {
    return res
    .status(200)
    .json(
        new ApiResponse(200,req.user,"Current user fetched successfully")
    )
})

const updateAccountDetails = asyncHandler(async(req,res) => {
    const {fullName, email} = req.body
    if(!fullName || !email) {
        throw new ApiError(400,"All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {new:true}
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Account details updated successfully")
    )
})

const updateUserAvatar = asyncHandler(async(req,res) => {
    const avatarlocalPath = req.file?.path

    if(!avatarlocalPath) {
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarlocalPath)

    if(!avatar.url) {
        throw new ApiError(400,"Error while uploading on avatar")
    }

    const currentUser = await User.findById(req.user?._id)

    if(!currentUser) {
        throw new ApiError(404,"User not found")
    }

    const oldAvatarUrl = currentUser.avatar

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    // delete the old image
    if(oldAvatarUrl) {
        deletFro
    }

    return res
    .status(200)
    .json(200,user,"Avatar updated successfully")
})

const updateUsercoverImage = asyncHandler(async(req,res) => {
    const coverImagelocalPath = req.file?.path

    if(!coverImagelocalPath) {
        throw new ApiError(400,"cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImagelocalPath)

    if(!coverImage.url) {
        throw new ApiError(400,"Error while uploading on cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(200,user,"cover image updated successfully")
})

const getUserChannelProfile = asyncHandler(async (req,res) => {
    const {username} = req.params

    if(!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {    // This ensures that only one document will be passed
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup: {
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size:"$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel?.length) {
        throw new ApiError(404,"channel doesnot exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req,res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project: {
                                        fullName:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
        
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUsercoverImage,
    getUserChannelProfile,
    getWatchHistory
}

/*
Scenario: Movie Streaming App
Characters: User: Alice
            Client: Movie Streaming App (Frontend)
            Server: Movie Streaming Backend (API)
Tokens: Access Token: Short-lived (e.g., 15 minutes) and used to access protected resources like Alice's watchlist or her movie recommendations.
        Refresh Token: Long-lived (e.g., 7 days) and used to obtain new access tokens when the access token expires.

Flow of Access and Refresh Tokens :-
1. Login: Initial Token Generation
    -> Alice logs into the app by providing her username and password.
    -> The server validates her credentials and generates:
    -> An access token (valid for 15 minutes).
    -> A refresh token (valid for 7 days).

2. Making Requests with the Access Token
    -> Alice wants to view her personalized movie recommendations.
    -> The app sends a request to the server with the access token in the header.
    -> The server verifies the access token and responds with Alice's movie recommendations.

3. Access Token Expiry
    -> After 15 minutes, the access token expires.
    -> Alice tries to add a movie to her watchlist. The request fails because the access token is no longer valid.

4. Using the Refresh Token
    -> Instead of asking Alice to log in again, the app sends the refresh token to the server to get a new access token.
    -> The server:
           .Verifies the refresh token.
           .Issues a new access token (valid for 15 minutes).
           .Rotates the refresh token (issues a new one).

5. Continuing the Session
    -> The app stores the new tokens and retries the failed request (to add the movie to Alice's watchlist).
    -> Alice’s session continues seamlessly without needing to log in again.

6. Refresh Token Expiry
    -> After 7 days, the refresh token also expires.
    -> If Alice tries to use an expired refresh token:
        . The server rejects it, and Alice is logged out.
        . She needs to log in again to get new tokens.
*/