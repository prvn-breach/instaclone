const validation = require('../helpers/validate');
const isEmpty = require('../validation/is-empty');
const JsonApiResponse = require("../helpers/JsonApiResponse");
const { getUser, getUsers } = require("../users");

const UserConversation = require("../models/UserConversation");
const User = require('../models/User');
const Post = require('../models/Post');

const getConversation = async (req, res) => {
    let sender_id = req.user._id;
    try {
        let user_conversation = await UserConversation.findOne({ user_id: sender_id });
        return JsonApiResponse.success(res, 'Successfully fetched user conversation.', user_conversation);
    } catch (error) {
        return JsonApiResponse.error(res, error.message, 500);
    }
}

const addUserToChat = async (req, res) => {
    const validationRules = {
        'user_id': 'required'
    }

    let errors = validation(req.body, validationRules, {});
    if (Object.keys(errors).length > 0) {
        return JsonApiResponse.error(res, 'Invalid request data', 422, errors);
    }

    const sender_id = req.user._id;
    const receiver_id = req.body.user_id;

    if (sender_id.toString() === receiver_id) {
        return JsonApiResponse.error(res, 'You are not able to add current user to chat', 422);
    }

    let receiver;

    try {
        receiver = await User.findById(receiver_id);
        if (!receiver) {
            return JsonApiResponse.error(res, 'Reciever was not found', 404);
        }
    } catch (error) {
        return JsonApiResponse.error(res, error.message, 500);
    }

    let posts_count;
    try {
        posts_count = await Post.count({ user: receiver_id });
    } catch (error) {
        return JsonApiResponse.error(res, error.message, 500)
    }

    let user_conversation;
    try {
        user_conversation = await UserConversation.findOne({ user_id: sender_id });
    } catch (error) {
        return JsonApiResponse.error(res, error.message, 500);
    }


    let conversation_user_data = {
        receiver_id: receiver['_id'],
        receiver_name: receiver['name'],
        receiver_username: receiver['username'],
        receiver_image: receiver['image'],
        followers: receiver['followers'].length,
        posts: posts_count,
    };

    try {
        let already_exists = user_conversation.conversation_users.find(user => user.receiver_id.toString() === receiver_id);
        if (already_exists) {
            return JsonApiResponse.error(res, 'Receiver already existed in chat list', 409);
        }
        await user_conversation.conversation_users.push(conversation_user_data);
        await user_conversation.save();
    } catch (error) {
        return JsonApiResponse.error(res, error.message, 500);
    }

    return JsonApiResponse.success(res, 'Successfully Created User Conversation.', conversation_user_data);
}

const removeUserFromChat = async (req, res) => {
    const validationRules = {
        'user_id': 'required'
    }

    let errors = validation(req.body, validationRules, {});
    if (Object.keys(errors).length > 0) {
        return JsonApiResponse.error(res, 'Invalid request data', 422, errors);
    }

    let receiver_id = req.body.user_id;
    let sender_id = req.user._id;

    try {
        let user_conversation = await UserConversation.findOne({ user_id: sender_id });
        user_conversation.conversation_users = user_conversation.conversation_users.filter(conversation_user => conversation_user.receiver_id.toString() != receiver_id);
        user_conversation.messages = user_conversation.messages.filter(message => message.receiver_id.toString() != receiver_id);
        await user_conversation.save();
        return JsonApiResponse.success(res, "Successfully removed user from chat list", receiver_id);
    } catch (error) {
        return JsonApiResponse.error(res, error.message, 500);
    }
}

const sendMessage = async (req, res) => {
    const validationRules = {
        'message': 'required',
        'user_id': 'required'
    }

    let errors = validation(req.body, validationRules, {});
    if (Object.keys(errors).length > 0) {
        return JsonApiResponse.error(res, 'Invalid request data', 422, errors);
    }

    let receiver_id = req.body.user_id;
    let sender_id = req.user._id;

    if (sender_id.toString() === receiver_id) {
        return JsonApiResponse.error(res, 'you are not able to send message to current user', 422);
    }

    let receiver;
    try {
        receiver = await User.findById(receiver_id);
        if (isEmpty(receiver)) {
            return JsonApiResponse.error(res, 'receiver was not found', 404);
        }
    } catch (error) {
        return JsonApiResponse.error(res, error.message, 500);
    }

    let sender;
    try {
        sender = await User.findById(sender_id);
        if (isEmpty(sender)) {
            return JsonApiResponse.error(res, 'sender was not found', 404);
        }
    } catch (error) {
        return JsonApiResponse.error(res, error.message, 500);
    }

    let posts_count;
    try {
        posts_count = await Post.count({ user: sender_id });
    } catch (error) {
        return JsonApiResponse.error(res, error.message, 500)
    }

    let message_data = {
        message: req.body.message,
        receiver_id: receiver['_id'],
        sender_id: sender['_id']
    };

    try {
        let sender_conversation = await UserConversation.findOne({ user_id: sender_id });
        await sender_conversation.messages.push(message_data);
        await sender_conversation.save();

        let receiver_conversation = await UserConversation.findOne({ user_id: receiver_id });
        let sender_conversation_data = receiver_conversation.conversation_users.find(user => user.receiver_id.toString() === sender_id.toString());
        let new_conversation = null;
        if (isEmpty(sender_conversation_data)) {
            new_conversation = {
                receiver_id: sender['_id'],
                receiver_name: sender['name'],
                receiver_username: sender['username'],
                followers: sender['followers'].length,
                posts: posts_count
            };
            await receiver_conversation.conversation_users.push(new_conversation);
        }
        await receiver_conversation.messages.push(message_data);
        await receiver_conversation.save();
        getUser(message_data['receiver_id']).emit('sendMessage', { message: message_data, new_conversation: new_conversation });
        return JsonApiResponse.success(res, "Successfully send message to receiver", message_data);
    } catch (error) {
        return JsonApiResponse.error(res, error.message, 500);
    }
}

const deleteMessage = async (req, res) => {
    const validationRules = {
        'message_id': 'required'
    }

    let errors = validation(req.body, validationRules, {});
    if (Object.keys(errors).length > 0) {
        return JsonApiResponse.error(res, 'Invalid request data', 422, errors);
    }

    let sender_id = req.user._id;
    let message_id = req.body.message_id;

    try {
        let user_conversation = await UserConversation.findOne({ user_id: sender_id });
        user_conversation.messages = await user_conversation.messages.filter(message => message['_id'].toString() != message_id);
        await user_conversation.save();
        return JsonApiResponse.success(res, "Successfully message deleted", message_id);
    } catch (error) {
        return JsonApiResponse.error(res, error.message, 500);
    }
}

exports.getConversation = getConversation;
exports.addUserToChat = addUserToChat;
exports.removeUserFromChat = removeUserFromChat;
exports.sendMessage = sendMessage;
exports.deleteMessage = deleteMessage;