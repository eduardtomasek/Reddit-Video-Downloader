# Reddit Video Downloader [Sunday Projects]
Download videos from given subreddit.

Creates video folder with subfolder with subreddit name. It is not downloading same video twice. (It means from same post. If another user upload same video, this is not recognized) So you can run it again on same subreddit to get new videos. It is sorting subreddit posts by date from newest.

# Usage
```shell
# this will tak first 50 posts and try to find videos
node download.js --subreddit <name>

# this go through all subreddit
node download.js --subreddit <name> --grabAll

# same as before but one page has 100 posts
node download.js --subreddit <name> --grabAll --limit 100 

# go just through first two pages
node download.js --subreddit <name> --grabAll --limit 100 --pagestop 2

# if you provide ffmpeg path it will write video title and text into meta comment
node download.js --subreddit <name> --grabAll --limit 100 --ffmpeg D:\Programs\ffmpeg-5.0-full_build\bin\ffmpeg.exe --pagestop 1 

# after 10 already downloaded videos records in the row script is ended
node download.js --subreddit <name> --grabAll --limit 100 --ffmpeg D:\Programs\ffmpeg-5.0-full_build\bin\ffmpeg.exe --pagestop 1 --stopCount 10
```