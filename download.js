/**
 * SOURCES
 * 	- https://github.com/axios/axios
 *  - https://www.npmjs.com/package/commander#quick-start
 *  - https://github.com/reddit-archive/reddit/wiki/API
 *  - https://www.reddit.com/dev/api/
 *  - https://www.kindacode.com/article/using-axios-to-download-images-and-videos-in-node-js/
 *  - https://nodejs.org/api/url.html#urlpathname
 *  - https://momentjs.com/docs/
 *  - https://www.npmjs.com/package/sanitize-filename
 */

const _ = require('lodash')
const axios = require('axios').default
const { program } = require('commander')
const fs = require('fs')
const path = require('path')
const sanitize = require('sanitize-filename')
const mkdirp = require('mkdirp')
const moment = require('moment')
const ffmetadata = require("ffmetadata")

const USER_AGENT = 'NodeJs subreddit parser v0.1'
const TIMESTAMP_FORMAT = 'YYYYMMDD-HHmmss'

/**
 * FUNCTIONS
 */
const sleep = (ms) => {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

const getPostVideo = (data) => {
	return _.get(data, 'secure_media.reddit_video.fallback_url', null)
}

const downloadFile = async ({ fileUrl, downloadFolder, title, timestamp, author }) => {
	const u = new URL(fileUrl)

	const fileName = sanitize(`${timestamp}_${title.replace(/ /g, '_')}_(${author})_${path.basename(u.pathname)}`)
	const localFilePath = path.resolve(__dirname, downloadFolder, fileName)

	await mkdirp(downloadFolder)

	try {
		const response = await axios({
			method: 'get',
			url: fileUrl,
			responseType: 'stream',
			headers: {
				'User-Agent': USER_AGENT,
			}
		})

		const w = response.data.pipe(fs.createWriteStream(localFilePath))

		const downloadingFilePromise = new Promise((resolve, reject) => {
			w.on('finish', () => {
				console.log(`DOWNLOADED [${fileUrl}] [${localFilePath}].`)
				resolve()
			})
		})

		await downloadingFilePromise

	} catch (e) {
		throw new Error(e)
	}

	return localFilePath
}

const storeArchive = ({ archive, folder }) => {
	fs.writeFileSync(path.resolve(folder, 'archive.json'), JSON.stringify(archive, null, 2))
}

const loadArchive = ({ folder }) => {
	try {
		const data = fs.readFileSync(path.resolve(folder, 'archive.json'), { encoding: 'utf8', flag: 'r' })

		return JSON.parse(data)
	} catch (e) {
		return []
	}
}

const ffmetadataWrite = (file, data) => {
	return new Promise((resolve, reject) => {
		ffmetadata.write(file, data, (err) => {
			if (err) {
				reject(err)
			}

			resolve(true)
		})
	})
}

program
	.option('-s, --subreddit <string>')
	.option('-l, --limit <number>')
	.option('-f, --ffmpeg <string>')
	.option('-p, --pagestop <number>')
	.option('--grabAll')
	.option('--stopCount <number>')

program.parse()

	; (async () => {
		const options = program.opts()
		const subreddit = options.subreddit
		const stopCount = parseInt(options.stopCount, 10)
		const grabAllFlag = Boolean(options.grabAll)
		const limit = options.limit ? parseInt(options.limit) : 50
		const pageStop = options.pagestop ? parseInt(options.pagestop, 10) : null
		const saveMetadata = Boolean(options.ffmpeg)

		if (saveMetadata) {
			ffmetadata.setFfmpegPath(options.ffmpeg)
		}

		const fullUrl = `https://www.reddit.com/r/${subreddit}/new/.json`

		try {
			await axios({
				url: fullUrl,
				method: 'get',
				headers: {
					'User-Agent': USER_AGENT,
				},
				params: {
					limit: 1
				}
			})
		} catch (e) {
			console.error(`Cannot get ${fullUrl}. Bye! ${e.message}`)
			process.exit()
		}

		let forceStop = false
		let hasMore = true
		let after = null
		let page = 0
		let alreadyDownloadedCounter = 0

		while (hasMore && !forceStop) {
			console.log(`Page #${++page}`)

			let items = []

			try {
				items = await axios({
					url: fullUrl,
					method: 'get',
					headers: {
						'User-Agent': USER_AGENT,
					},
					params: {
						limit: limit,
						after,
					}
				}).then(response => response.data)
			} catch (e) {
				console.error(`Page fetch failed! ${e.message}`)
				continue
			}

			const children = _.get(items, 'data.children', [])
			after = _.get(items, 'data.after', null)
			hasMore = Boolean(after)

			for (const item of children) {
				const videoURL = getPostVideo(item.data)
				const title = _.get(item, 'data.title', '')
				const selfText = _.get(item, 'data.selfText', '')
				const permalink = _.get(item, 'data.permalink', '')
				const isVideo = _.get(item, 'data.is_video', false)
				const created = _.get(item, 'data.created_utc', null)
				const timestamp = _.isNumber(created) ? moment.unix(parseInt(created, 10)).format(TIMESTAMP_FORMAT) : moment().format(TIMESTAMP_FORMAT)
				const trimmedTitle = title && title.length > 30 ? title.substring(0, 30) : title
				const author = _.get(item, 'data.author_fullname', '')
				const downloadFolder = path.resolve('./videos', sanitize(subreddit))

				const archive = loadArchive({ folder: downloadFolder })

				try {
					const alreadyDownloaded = archive.includes(videoURL)

					if (alreadyDownloaded && _.isNumber(stopCount)) {
						alreadyDownloadedCounter++

						if (alreadyDownloadedCounter >= stopCount) {
							forceStop = true
							break
						}
					}

					if (isVideo && !alreadyDownloaded) {
						alreadyDownloadedCounter = 0
						const localFilePath = await downloadFile({ fileUrl: videoURL, title: trimmedTitle, downloadFolder, timestamp, author })

						archive.push(videoURL)
						storeArchive({ archive, folder: downloadFolder })

						if (saveMetadata) {
							await ffmetadataWrite(localFilePath, {
								comment: `${permalink} \n\n${title} \n${selfText}`,
							})
						}
					} else {
						console.log(`SKIPPED ${!isVideo ? 'not a video' : ''}${alreadyDownloaded ? 'already downloaded' : ''} [${title}] `)
					}
				} catch (e) {
					console.error(`${title} download error! ${e.message}`)
				}

				await sleep(1000)
			}

			if (!grabAllFlag) {
				hasMore = false
			}

			if (pageStop && pageStop <= page) {
				hasMore = false
			}
		}

	})()