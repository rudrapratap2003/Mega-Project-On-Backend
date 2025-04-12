import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asynchandler.js"
import {Video} from "../models/video.model.js"
import {Comment} from "../models/comment.model.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    if(!videoId && !isValidObjectId(videoId)) {
        throw new ApiError(400,"Invalid video ID")
    }

    const video = await Video.findById(videoId)
    if(!video) {
        throw new ApiError(404,"Video not found")
    }

    const videoLiked = await Like.findOne(
        {
            video: videoId,
            likedBy: req.user._id
        },
        {new: true}
    )
    if(!videoLiked) {
        await Like.create({
            video: videoId,
            likedBy: req.user._id
        })
        
    } else {
        await Like.findByIdAndDelete(videoLiked._id)
    }

    return res
    .status(200)
    .json(new ApiResponse(200,video,"Video likes toggled successfully"))
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    if(!commentId && !isValidObjectId(commentId)) {
        throw new ApiError(400,"Invalid Comment ID")
    }

    const comment = await Comment.findById(commentId)
    if(!comment) {
        throw new ApiError(404,"Comment not Found")
    }

    const commentLiked = await Like.findOne(
        {
            comment: commentId,
            likedBy: req.user._id
        },
        {new: true}
    )
    if(!commentLiked) {
        await Like.create({
            comment: commentId,
            likedBy: req.user._id
        })
    } else {
        await Comment.findByIdAndDelete(commentLiked._id)
    }

    return res
    .status(200)
    .json(new ApiResponse(200,comment,"Comment likes toggled successfully"))
})

const getLikedVideos = asyncHandler(async (req, res) => {
    const videosLiked = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(req.user._id),
                video: {$ne: null}
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "likedVideos",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "videoOwner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                ]
            }
        },
        {
            $addFields: {
                titalLikes: {
                    $size: "$likedVideos"
                }
            }
        }
    ])

    if(!videosLiked?.length) {
        throw new ApiError(400,"No videos liked by the user")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,videosLiked[0].likedVideos,"Liked Videos fetched successfully")
    )
})

export {
    toggleCommentLike,
    toggleVideoLike,
    getLikedVideos
}