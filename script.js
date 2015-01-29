(function () {
    var accessToken;

    function getAuthCode(code) {
        //https://developers.google.com/youtube/v3/guides/authentication
        var _data = {
            code: code,
            client_id: "27213028471-7ra8pr97k4sk67icbdt9ga7gphkv069k.apps.googleusercontent.com",
            client_secret: "wv51zcRWFQoXYvLGjwwEl9BN",
            //   redirect_uri: "http://localhost/pewpew/oauth2callback",//encodeURIComponent("http://localhost/pewpew/oauth2callback"),
            grant_type: "authorization_code"
        };


        $.ajax({
            url: 'https://accounts.google.com/o/oauth2/token',
            method: 'POST',
            data: $.param(_data),
            success: function (data) {
                var json = JSON.parse(data);
                //json.access_token 
                //json.refresh_token
                //json.expires_in
            }
        });

        //next https://developers.google.com/accounts/docs/OAuth2WebServer#refresh
    }

    window.oauth2Callback = function (authResult) {
        if (authResult['access_token']) {
            accessToken = authResult['access_token'];

            //var code = authResult['code'];
            //getAuthCode(code);

            console.log(accessToken);
            $.ajax({
                url: 'https://www.googleapis.com/youtube/v3/channels',
                method: 'GET',
                headers: {
                    Authorization: 'Bearer ' + accessToken
                },
                data: {
                    part: 'snippet',
                    mine: true
                }
            }).done(function (response) {
                $('#channel-name').text(response.items[0].snippet.title);
                $('#channel-thumbnail').attr('src', response.items[0].snippet.thumbnails.default.url);

                $('.pre-sign-in').hide();
                $('.post-sign-in').show();
            });
        }
    };
    function initiateUploadThumbnail(videoId) {
        var file = $('#thumb').get(0).files[0];

        $.ajax({
            url: 'https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=' + videoId + '&uploadType=resumable',
            method: 'POST',
            contentType: 'application/json',
            headers: {
                Authorization: 'Bearer ' + accessToken
            },
            data: ""
        }).done(function (data, textStatus, jqXHR) {
            uploadThumbnail({
                url: jqXHR.getResponseHeader('Location'),
                file: file
            });

        });
    };
    function uploadThumbnail(options) {
        $.ajax({
            url: options.url,
            method: 'POST',
            contentType: options.file.type,

            xhr: function () {
                var xhr = $.ajaxSettings.xhr();
                if (xhr.upload) {
                    xhr.upload.addEventListener(
                      'progress',
                      function (e) {
                          if (e.lengthComputable) {
                              var bytesTransferred = e.loaded;
                              var totalBytes = e.total;
                              var percentage = Math.round(100 * bytesTransferred / totalBytes);

                              $('#upload-progress-1').attr({
                                  value: bytesTransferred,
                                  max: totalBytes
                              });

                              $('#percent-transferred-1').text(percentage);
                              $('#bytes-transferred-1').text(bytesTransferred);
                              $('#total-bytes-1').text(totalBytes);

                          }
                      },
                      false
                    );
                }
                return xhr;
            },
            processData: false,
            data: options.file
        }).done(function (data, textStatus, jqXHR) {
            if (("#log").html().length > 0) {
                $("#log").html("<p>Status: " + textStatus + "</p>");
            }
        });
    }
    function initiateUpload(e) {
        e.preventDefault();
        var file = $('#file').get(0).files[0];
        if (file) {
            $('#submit').attr('disabled', true);

            var privacy = $('#privacy-status option:selected').text();
            var optionTexts = [];
            $(".user-profile-info-interests-container li").each(function () { optionTexts.push($(this).text()); });
            var metadata = {
                snippet: {
                    title: $('#title').val(),
                    description: $('#description').val(),
                    tags: optionTexts,
                    categoryId: 22,

                },
                status: {
                    privacyStatus: privacy
                }
            };

            $.ajax({
                url: 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
                method: 'POST',
                contentType: 'application/json',
                headers: {
                    Authorization: 'Bearer ' + accessToken,
                    'x-upload-content-length': file.size,
                    'x-upload-content-type': file.type
                },
                data: JSON.stringify(metadata)
            }).done(function (data, textStatus, jqXHR) {
                resumableUpload({
                    url: jqXHR.getResponseHeader('Location'),
                    file: file,
                    start: 0
                });
            });
        }
    }
    function resumableUpload(options) {
        var ajax = $.ajax({
            url: options.url,
            method: 'PUT',
            contentType: options.file.type,
            headers: {
                'Content-Range': 'bytes ' + options.start + '-' + (options.file.size - 1) + '/' + options.file.size
            },
            xhr: function () {
                var xhr = $.ajaxSettings.xhr();
                if (xhr.upload) {
                    xhr.upload.addEventListener(
                      'progress',
                      function (e) {
                          if (e.lengthComputable) {
                              var bytesTransferred = e.loaded;
                              var totalBytes = e.total;
                              var percentage = Math.round(100 * bytesTransferred / totalBytes);

                              $('#upload-progress').attr({
                                  value: bytesTransferred,
                                  max: totalBytes
                              });

                              $('#percent-transferred').text(percentage);
                              $('#bytes-transferred').text(bytesTransferred);
                              $('#total-bytes').text(totalBytes);

                              $('.during-upload').show();
                          }
                      },
                      false
                    );
                }

                return xhr;
            },
            processData: false,
            data: options.file
        });

        ajax.done(function (response) {
            var videoId = response.id;
            $('#video-id').text(videoId);
            $('.post-upload').show();
            checkVideoStatus(videoId, 5000);//every 5 sec
        });

        ajax.fail(function () {
            $('#submit').click(function () {
                alert('Not yet implemented!');
            });
            $('#submit').val('Resume Upload');
            $('#submit').attr('disabled', false);
        });
    }
    function checkVideoStatus(videoId, waitForNextPoll) {
        $.ajax({
            url: 'https://www.googleapis.com/youtube/v3/videos',
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + accessToken
            },
            data: {
                part: 'status,processingDetails,player',
                id: videoId
            }
        }).done(function (response) {

            initiateUploadThumbnail(videoId);


            var processingStatus = response.items[0].processingDetails.processingStatus;
            var uploadStatus = response.items[0].status.uploadStatus;

            $('#post-upload-status').append('<li>Processing status: ' + processingStatus + ', upload status: ' + uploadStatus + '</li>');

            if (processingStatus == 'processing') {
                setTimeout(function () {
                    checkVideoStatus(videoId, waitForNextPoll * 2);
                }, waitForNextPoll);
            } else {
                if (uploadStatus == 'processed') {
                    $('#player').append(response.items[0].player.embedHtml);
                } else if (uploadStatus == "rejected") {
                    $('#post-upload-status').append('<li style="color: red;">Rejection reason: ' + response.items[0].status.rejectionReason + '</li>');
                }

                $('#file-block').html('<input id="file" type="file" accept="video/*">');
                $('#post-upload-status').append('<li>Final status.</li>');
            }
        });
    }
    function readTumb(input) {
        if (input.files && input.files[0]) {
            var reader = new FileReader();

            reader.onload = function (e) {
                $('#thumb-img').attr('src', e.target.result).show();
            };

            reader.readAsDataURL(input.files[0]);
        }
    }

    $(function () {
        $.getScript("https://apis.google.com/js/client:plusone.js");

        $('#upload-form').submit(initiateUpload);
        $("#thumb").change(function () {
            readTumb(this);
        });

        $('.user-profile-header-tags-input').on('keypress', function (e) {
            if (e.keyCode == 32) {
                if (e.target.value.length > 0) {
                    $('.user-profile-info-interests-container').find('ul').append('<li>' + e.target.value + '</li>');
                    $(e.target).val('');
                }
            }
        });
    });
})();