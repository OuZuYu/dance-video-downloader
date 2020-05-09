const fs = require('fs')
const superagent = require('superagent')
const cheerio = require('cheerio')
const ora = require('ora')
const inquirer = require('inquirer');
const ffmpeg = require('fluent-ffmpeg')

const utils = {
  /**
   * HH:mm:ss 转换成秒数
   * @param {string} hms 时间，格式为HH:mm:ss
   */
  hmsToSeconds(hms) {
    const hmsArr = hms.split(':')

    return (+hmsArr[0]) * 60 * 60 + (+hmsArr[1]) * 60 + (+hmsArr[2])
  },

  /**
   * 秒数转换成 HH:mm:ss
   * @param {number}} seconds 秒数
   */
  secondsToHms(seconds) {
    const date = new Date(null)
    date.setSeconds(seconds)
    return date.toISOString().substr(11, 8)
  }
}

const downloader = {
  url: process.argv[2],
  VIDEO_URL_REG: /video:\s?'(https?\:\/\/\S+)'/,
  DOWNLOAD_PATH: 'gcw.mp4',
  CUT_RESULT_PATH: 'gcw_cut.mp4',

  run() {
    if (!this.url) {
      console.log('请输入 51广场舞 或 糖豆广场舞 地址')
      return
    }

    const scraping = ora('正在抓取网页...\n').start()

    superagent
      .get(this.url)
      .end((err, res) => {
        if (err) {
          return console.log(err)
        }
        scraping.succeed('已成功抓取到网页\n')

        const downloadLink = this.getDownloadLink(res.text)
        this.downloadVideo(downloadLink)
      })
  },

  is51Gcw(url) {
    return url.indexOf('51gcw') > -1
  },

  isTangDou(url) {
    return url.indexOf('tangdou') > -1
  },

  getDownloadLink(html) {
    const $ = cheerio.load(html)
    let downloadLink
    if (this.is51Gcw(this.url)) {
      downloadLink = $('.play_xz_mp4 a').eq(1).attr('href')
    } else if (this.isTangDou(this.url)) {
      const match = this.VIDEO_URL_REG.exec(html)
      downloadLink = match && match[1]
    }
    return downloadLink
  },

  downloadVideo(downloadLink) {
    console.log(`${downloadLink}\n`)
    if (!downloadLink) {
      console.log('获取下载链接失败')
      return
    }
    const downloading = ora('正在下载视频...\n').start()

    const file = fs.createWriteStream(this.DOWNLOAD_PATH)
    file.on('close', () => {
      downloading.succeed('已成功下载视频\n')

      this.cutVideo()
    })

    superagent
      .get(downloadLink)
      .pipe(file)
  },

  cutVideo() {
    inquirer.prompt([
      {
        type: 'confirm',
        name: 'needCut',
        message: '是否需要裁剪？',
        default: true
      },
      {
        type: 'input',
        name: 'startTime',
        message: '请输入开始时间, 默认为 00:00:00 (HH:mm:ss)',
        default: '00:00:00',
        when: ({ needCut }) => needCut
      },
      {
        type: 'input',
        name: 'endTime',
        message: '请输入结束时间, 默认为视频结束时间 (HH:mm:ss)',
        when: ({ needCut }) => needCut
      }
    ]).then(({ needCut, startTime, endTime }) => {
      if (!needCut) {
        process.exit()
      }

      ffmpeg
        .ffprobe(this.DOWNLOAD_PATH, (err, metadata) => {
          const videoDuration = metadata.format.duration
          const startSecond = utils.hmsToSeconds(startTime)
          const endSecond = endTime ? utils.hmsToSeconds(endTime) : videoDuration
          const cutDuration = endSecond - startSecond

          console.log(`\n开始时间：${startTime}`)
          console.log(`结束时间：${endTime}`)
          console.log(`开始时间(s)：${startSecond}`)
          console.log(`结束时间(s)：${endSecond}`)
          console.log(`裁剪后时长(s)：${cutDuration}\n`)

          const cutting = ora('正在裁剪视频...\n').start()
          ffmpeg(this.DOWNLOAD_PATH)
            .setStartTime(startTime)
            .setDuration(cutDuration)
            .saveToFile(this.CUT_RESULT_PATH)
            .on('end', () => {
              cutting.succeed(`已成功裁剪视频，输出为 ${this.CUT_RESULT_PATH} `)
            })
        })

    })
  }
}

downloader.run()