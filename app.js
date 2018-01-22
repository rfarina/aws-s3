const express = require('express');
const AWS = require('aws-sdk');

// Set the Region (override from default)
/*
    Note: for s3, config is automatically read from ~/.aws/config
    However, for sqs, the region is not coming in. 

    So, we can:
    1. override for all services by updating AWS.config.update({region:'my-region'})
    2. override for specific service upon instanciation of the service sqs = new AWS.SQS({region:'my-region'})
*/

// Override all regions
// AWS.config.update({region:'us-west-1'});

const app = express();
const s3 = new AWS.S3();

// Instanciate and set region
const sqs = new AWS.SQS({ region: 'us-west-2' });

// SNS
const sns = new AWS.SNS({region: 'us-west-2'});

const createBucketParms = {
    Bucket: "rfarinaaws-s3-api-test",
    ACL: "private",
    CreateBucketConfiguration: {
        LocationConstraint: "us-west-2"
    }
};

const deleteBucketParms = {
    Bucket: "rfarinaaws-s3-api-test",
};

const objectParms = {

}

// Simple Get that does not require authorization
app.get('/api', (req, res) => {
    res.json({
        message: 'Welcome to the S3 API'
    });
});

// Create a bucket using AWS.Request
app.get('/api/createReq', (req, res) => {
    var awsRequest = s3.createBucket(createBucketParms);

    // Process awsRequest
    if (awsRequest) {
        awsRequest.send();
        awsRequest.on('success', function (response) {
            res.write("success " + '\n' + response.data.Location);
            res.end();
            // res.json({
            //     msg: "AWS Request successfully processed",
            //     response: response
            // })
            console.log("AWS.Request success returned by create bucket \n", response);
        })

        awsRequest.on('error', function (response) {
            res.write('failure ' + '\n' + response.code);
            res.end();
            // res.json({
            //     msg: "AWS Request failed",
            //     response: response
            // })
            console.log("AWS.Request failure returned by create bucket \n", response);

        })

    }
})


// Create a bucket
app.get('/api/create', (req, res) => {
    s3.createBucket(createBucketParms, function (err, data) {
        if (err) {
            console.log(err);
            res.json({
                msg: "error on create bucket",
                error: err
            })
        } else {
            console.log('Bucket created: ', data);
            res.json({
                msg: "Bucket created"
            })
        }
    })

})

// Delete bucket
app.get('/api/delete', (req, res) => {
    s3.deleteBucket(deleteBucketParms, function (err, data) {
        if (err) {
            console.log(err);
            res.json({
                msg: "error on delete bucket",
                error: err
            })
        } else {
            console.log('Bucket deleted: ', data);
            res.json({
                msg: "Bucket deleted"
            })
        }
    })

})

app.get('/api/sqs/send', function (req, res) {
    const sendMsgParams = {
        QueueUrl: "https://sqs.us-west-2.amazonaws.com/177308375997/myStandardQueue",
        MessageBody: "This message was place on queue by node js application at " + Date()

    }
    sqs.sendMessage(sendMsgParams, function (err, data) {
        if (err) {
            console.log(err);
            res.json({
                msg: "error on send message to queue",
                error: err
            })
        } else {
            console.log('Message successfully sent to queue \n', data);
            res.json({
                msg: "Message sent to queue",
                returnedData: data
            })
        }
    })

})


app.get('/api/sqs/receive', (req, res) => {

    sqs.receiveMessage(receiveMsgParams, (err, data) => {
        if (err) {
            console.log('Error on receive message \n', err);
            res.json({
                msg: "error on receive message from queue",
                error: err
            })
        } else {
            console.log('Success on receive message \n', data.Messages[0].ReceiptHandle);
            // Now delete the message 
            deleteMessage(data.Messages[0].ReceiptHandle)  // returns promise
            .then(
                (success) => {
                    console.log("Success on delete message \n", data);
                    res.json({
                        msg: "Message received from queue and delete status",
                        returnedData: data
                    })
                }
            )
            .catch(
                (failure) => {
                    console.log("Error on delete message \n", err);
                    res.json({
                        msg: "Message received from queue and delete status",
                        returnedData: data
                    })
                }
            )
        }
    })
})


app.get('/api/sqs/receive2', (req, res) => {
    let msgReceived = false;
    let msgDeleted = false;
    let rcvData;
    // let delMsg;

    const WaitTimeSeconds = 5;
    receiveMessage(WaitTimeSeconds)  // returns promise
    .then((msgData) => {
        if(msgData.Messages[0]) {
            msgReceived = true;
            rcvData = Object.assign({},msgData);
            // Return a new promise for the delete message process
            return deleteMessage(msgData.Messages[0].ReceiptHandle); // returns new promise
            // return deleteMessage("xxx");
        } else {
            msgReceived = false;
            rcvData = {};
        }
    })
   .then((successfulDelete) => {
            msgDeleted = true;
            console.log('Success on receive message-2 and corresponding delete of message \n');
            res.json({
                msg: "Message-2 received from queue and deleted",
                msgData: rcvData,
                msgReceived,
                msgDeleted,
                successfulDelete: successfulDelete
            })
    })
    .catch(
        (err) => {
            console.log('Error on receive message-2 \n', err);
            res.json({
                msg: "error on receive message from queue and subsequent deletion",
                msgReceived,
                msgDeleted,
                error: err
            })
    
    })

})

app.get('/api/sns/publish', (req, res) => {
    const snsPublishParams = {
        Message: 'Published message via api as of ' + Date(),
        Subject: 'Subject of published msg from api...',
        TopicArn: 'arn:aws:sns:us-west-2:177308375997:mySNSTopic'
    }
    sns.publish(snsPublishParams, (err, data) => {
        if(err) {
            console.log('Error on sns publish: \n', err);
            res.json({
                msg:'Publish error',
                error: err
            })
        } else {
            console.log('Publish to Topic successfull \n', data);
            res.json({
                msg: 'Publish success',
                data: data
            })
        }
    })
})

app.post('/api/geodata', (req, res) => {
    // console.log('incoming request: \n', req.query.data);

    var jsonString = '';

    req.on('data', function (data) {
        jsonString += data;
    });

    req.on('end', function () {
        let payload = JSON.parse(jsonString);
        console.log(JSON.parse(jsonString));
        res.json({
            msg: 'The payload follows...',
            data: payload
        })
    });    
})

function receiveMessage(WaitTimeSeconds) {

    return new Promise((resolve, reject) => {

        const receiveMsgParams = {
            QueueUrl: "https://sqs.us-west-2.amazonaws.com/177308375997/myStandardQueue",
            WaitTimeSeconds: WaitTimeSeconds
        }
        sqs.receiveMessage(receiveMsgParams, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        })        

    }) // end promise

}


function deleteMessage(receiptHandle) {

    return new Promise((resolve, reject) => {

        const deleteMsgParams = {
            QueueUrl: "https://sqs.us-west-2.amazonaws.com/177308375997/myStandardQueue",
            ReceiptHandle: receiptHandle
        }
        sqs.deleteMessage(deleteMsgParams, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        })

    }) // end promise

}

// async function x() {
//     var promise = await new Promise(function(resolve, reject) {
//       setTimeout(function() {
//         resolve({a:42});
//       },100);
//     });
//     return promise;
//   }

const port = 5000;
app.listen(port, () => {
    console.log(`S3 server running on port ${port}`);
})