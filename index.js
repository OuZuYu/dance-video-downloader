const fs = require('fs')
const ffmpeg = require('fluent-ffmpeg')
const inquirer = require('inquirer');
const superagent = require('superagent')
const cheerio = require('cheerio')
const request = require('request')
const ora = require('ora')

const utils = {
  hmsToSeconds(hms) {
    const hmsArr = hms.split(':')

    return (+hmsArr[0]) * 60 * 60 + (+hmsArr[1]) * 60 + (+hmsArr[2])
  }
}

const downloader = {
  run() {
    const scraping = ora('正在抓取网页...\n').start()

    superagent
      .get(process.argv[2])
      .end((err, res) => {
        if (err) {
          return console.log(err)
        }
        scraping.succeed('已成功抓取到网页\n')

        this.downloadVideo(res.text)
      })
  },

  downloadVideo(html) {
    const $ = cheerio.load(html)
    const downloadLink = $('.play_xz_mp4 a').eq(1).attr('href')

    const downloading = ora('正在下载视频...\n').start()
    const file = fs.createWriteStream('gcw.mp4')
    request(downloadLink).pipe(file)
    file.on('close', () => {
      downloading.succeed('已成功下载视频\n')

      this.cutVideo()
    })
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
        message: '请输入开始时间 (HH:MM:SS)',
        default: '00:00:00',
        when: ({ needCut }) => needCut
      },
      {
        type: 'input',
        name: 'endTime',
        message: '请输入结束时间? (HH:MM:SS)',
        when: ({ needCut }) => needCut
      }
    ]).then(({ needCut, startTime, endTime }) => {
      if (!needCut) {
        process.exit()
      }

      let videoDuration, cutDuration
      ffmpeg
        .ffprobe('./gcw.mp4', (err, metadata) => {
          const startSecond = utils.hmsToSeconds(startTime)
          const endSecond = utils.hmsToSeconds(endTime)
          videoDuration = metadata.format.duration
          cutDuration = (videoDuration - startSecond) - (videoDuration - endSecond)

          console.log(`开始时间：${startTime}`)
          console.log(`结束时间：${endTime}`)
          console.log(`开始时间(s)：${startSecond}`)
          console.log(`结束时间(s)：${endSecond}`)
          console.log(`裁剪后时长(s)：${cutDuration}`)

          const cutting = ora('正在裁剪视频...\n').start()
          ffmpeg('./gcw.mp4')
            .setStartTime(startTime)
            .setDuration(cutDuration)
            .saveToFile('result.mp4')
            .on('end', function () {
              cutting.succeed('已成功裁剪视频，输出为 result.mp4 ')
            })
        })

    })
  }
}

downloader.run()