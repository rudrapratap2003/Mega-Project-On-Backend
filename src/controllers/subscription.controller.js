import mongoose,{isValidObjectId} from "mongoose";
import { User } from "../models/user.model";
import {Subscription} from "../models/subscription.model.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asynchandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    if(!channelId && !isValidObjectId(channelId)) {
        throw new ApiError(400,"Invalid Channel ID")
    }

    const fetchedChannel = await User.findById(channelId)
    if(!fetchedChannel) {
        throw new ApiError(404,"Channel not found")
    }

    const isSubscribedToChannel = await Subscription.findOne(
        {
            subscriber:req.user._id,
            channel: new mongoose.Types.ObjectId(channelId)
        },
        {new: true}
    )

    if(isSubscribedToChannel) {
        await Subscription.findByIdAndDelete(isSubscribedToChannel._id)
        return res.status(200).json(new ApiResponse(200,"Unsubscribed from channel"))
    } else {
        const subscribeToChannel = await Subscription.create({
            subscriber: req.user._id,
            channel: new mongoose.Types.ObjectId(channelId)
        })
        if(!subscribeToChannel) {
            throw new ApiError(500,"Failed to subscribe to channel")
        }
        return res.status(200).json(new ApiResponse(200,"Unsubscribed from channel"))
    }
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    if(!channelId && !isValidObjectId(channelId)) {
        throw new ApiError(400,"Invalid Channel ID")
    }

    const subscribersOfAChannel = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup: {
                from:"users",
                localField:"subscriber",
                foreignField:"_id",
                as:"subscribers"
            }
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                }
            }
        },
        {
            $project: {
                subscribers: {
                    fullName: 1,
                    username: 1,
                    avatar: 1
                },
                subscriberCount:1
            }
        }
    ])

    if(!subscribersOfAChannel) {
        throw new ApiError(400,"subscriber details can't be found")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,subscribersOfAChannel,"Channel subscribers fetched successfully")
    )
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params
    if(!subscriberId && !isValidObjectId(subscriberId)) {
        throw new ApiError(400,"Invalid subscriber ID")
    }

    const channelSubscribedTo = await Subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField:"channel",
                foreignField:"_id",
                as:"subscribedTo"
            }
        },
        {
            $addFields: {
                subscribedToCount: {
                    $size: "$subscribedTo"
                }
            }
        },
        {
            $project: {
                subscribedTo: {
                    fullName: 1,
                    username: 1,
                    avatar: 1
                },
                subscribedToCount: 1
            }
        }
    ])

    if(!channelSubscribedTo) {
        throw new ApiError(400,"Subscriber not found")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channelSubscribedTo,"Channels subscribed to fetched successfully")
    )
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}