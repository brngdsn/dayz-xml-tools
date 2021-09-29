// DEPS - BEGIN ----------------------------------------------------------------------------

const fs = require('fs')
const xml2js = require('xml2js')

const dayzXmlFilesPath = [
    `C:`, `Program Files (x86)`, `Steam`, `steamapps`, `common`,
    `DayZ`, `Missions`, `DayZCommunityOfflineMode.ChernarusPlus`
].join(`\\`)

const getDayZXMLFilesWindowsPath = (filePath) => {
    return [
        dayzXmlFilesPath,
        filePath
    ].join(`\\`)
}

const getFileAsString = (filePath) => {
    const path = getDayZXMLFilesWindowsPath(filePath)
    
    const file = fs.readFileSync(path, 'utf8')

    return file
}

const getJsFromXml = async (xmlString) => {
    return new Promise((resolve, reject) => {
        const parser = new xml2js.Parser()
        parser.parseString(xmlString, (error, results) => {
            resolve(results)
        })
    })
}

const getGroup = (groupName, x, y, z, r = 0, p = 0, yw = 0) => {
    let a
    if ((yw >= -179) && (yw <= -90)) {
        a = (yw * -1) - 270
    }
    if ((yw <= 179) && (yw >= -90)) {
        if (yw < 0) {
            a = (yw * -1) - 90
        } else {
            a = 90 - yw
        }
    }
    return `<group name="Socket_${groupName}" pos="${x} ${z} ${y}" rpy="${r} ${p} ${yw}" a="${a}" />`
}
  
const getGroups = (groupName, x, y, z, yawAngle, adjacencies) => {
    return `${getGroup(groupName, x, y, z, 0, 0, yawAngle)}
  ${adjacencies.reduce((a,c,i) => `${a}${getGroup(c, x - (i * .25), y, z + .5, 0, 0, yawAngle)}\n`, ``)}`
}
  
const getPos = (x, y, a) => {
    return `\n  <pos x="${x}" z="${y}" a="${a}"/>`
}
  
const getEventSpawn = (eventName, occurences) => {
    const classType = getClassType(eventName)
    const name = `${classType}${eventName}`
    return `<event name="${name}">${occurences.reduce((a,c,i) => `${a}${getPos(c[0], c[1], c[2])}`, ``)}\n</event>`
}
  
const getEvent = (eventName, occurences) => {
    const classType = getClassType(eventName)
    const name = `${classType}${eventName}`
    return `<event name="${name}">
    <nominal>${occurences.length}</nominal>
    <min>${occurences.length}</min>
    <max>${occurences.length}</max>
    <lifetime>3888000</lifetime>
    <restock>0</restock>
    <saferadius>0</saferadius>
    <distanceradius>0</distanceradius>
    <cleanupradius>0</cleanupradius>
    <flags deletable="1" init_random="0" remove_damaged="0" />
    <position>fixed</position>
    <limit>child</limit>
    <active>1</active>
    <children>
        <child lootmax="0" lootmin="0" max="1" min="1" type="${eventName}" />
    </children>
  </event>`
}
  
const getEventsXml = (eventName, occurences) => {
    const eventspawn = getEventSpawn(eventName, occurences)
    const event = getEvent(eventName, occurences)
    return `${eventspawn}\n\n${event}`
}
  
const getGroupsXml = (packageOccurences, packageContentsName, packageContents, altitude) => {
    return packageOccurences.reduce((a,c,i) => `${a}${getGroups(packageContentsName, c[0], c[1], altitude, c[2], packageContents)}`, ``)
}
  
const getPackageXml = (packageName, packageOccurences, packageContentsName, packageContents, altitude) => {
    const groupsXml = getGroupsXml(packageOccurences, packageContentsName, packageContents, altitude)
    const eventsXml = getEventsXml(packageName, packageOccurences)
    return `${groupsXml}\n\n${eventsXml}`
}

// DEPS -- END -----------------------------------------------------------------------------

// PROGRAM - BEGIN -------------------------------------------------------------------------

const f = n => parseFloat(n)

const spawnObjectMap = (className, xaz, ypr) => {
    const [x,a,z] = xaz.split(' ').map(f)
    const [y,p,r] = ypr.split(' ').map(f)
    return {
        className, x, a, z, y, p, r
    }
    // console.log(className, x ,a, z, y, p ,r)
    // console.log(`<>\n\t${className}\n\t${[x,a,z]}\n\t${[y,p,r]}\n</>\n`)
    // const existingEvent = existingEvents.filter(e => e.$.name.match(className))
    // console.log(existingEvent)
}

const eventSpawns = async (newEventSpawns) => {
    const cfgeventspawnsXmlString = getFileAsString(`cfgeventspawns.xml`)
    const existingEventSpawns = await getJsFromXml(cfgeventspawnsXmlString)

    newEventSpawns.forEach((newEventSpawn) => {
        const { x, z, y, className: _className } = newEventSpawn
        const className = _className.replace(/[0-9]*Land/g, `Land`)
        const classType = getClassType(className)
        const name = `${classType}${className}`
        let existingEventSpawnIndex = null
        const eventSpawnExists = existingEventSpawns.eventposdef.event.filter((e, i) => {
            if (e.$.name === name) {
                // console.log('found it', name, i)
                existingEventSpawnIndex = i
                return true
            } else {
                return false
            }
        })
        if (eventSpawnExists && existingEventSpawnIndex !== null) {
            // console.log('exists', name)
            existingEventSpawns.eventposdef.event[existingEventSpawnIndex].pos = [
                ...existingEventSpawns.eventposdef.event[existingEventSpawnIndex].pos,
                {
                    $: { x, z, a: y < 0 ? y + 360 : y }
                }
            ]
        } else {
            console.log('does not exist yet', name)
            existingEventSpawns.eventposdef.event = [
                {
                    $: { name: name },
                    pos: [
                        {
                            $: { x, z, a: y < 0 ? y + 360 : y }
                        }
                    ]
                },
                ...existingEventSpawns.eventposdef.event
            ]
        }
    })

    const builder = new xml2js.Builder()
    const existingEventSpawnsXml = builder.buildObject({
        ...existingEventSpawns,
    })
    console.log(existingEventSpawnsXml.substr(0,500))
    console.log(getDayZXMLFilesWindowsPath(`cfgeventspawns.xml`))
    fs.writeFileSync(`${getDayZXMLFilesWindowsPath(`cfgeventspawns.xml`)}`, existingEventSpawnsXml, 'utf8')
    return Promise.resolve()
}

const getClassType = (className) => {
    let classType = `Static`
    if (className.match('Truck') || className.match('Sedan') || className.match('Hatchback') || className.match('Olga')) {
        classType = `Vehicle`
    }
    if (className.match('UndergroundStash')) {
        classType = `Item`
    }
    return classType
}

const events = async (newEventSpawns) => {
    const eventsXmlString = getFileAsString(`db\\events.xml`)
    const existingEvents = await getJsFromXml(eventsXmlString)

    newEventSpawns.forEach((newEventSpawn) => {
        const { x, z, a, className: _className } = newEventSpawn
        const className = _className.replace(/[0-9]*Land/g, `Land`)
        const classType = getClassType(className)
        const name = `${classType}${className}`
        let existingEventIndex = null
        const eventExists = existingEvents.events.event.filter((e, i) => {
            if (e.$.name === name) {
                existingEventIndex = i
                return true
            } else {
                return false
            }
        })
        if (eventExists && existingEventIndex !== null) {
            // console.log(eventExists[0].children[0].child)
            const {
                nominal,
                min,
                max
            } = existingEvents.events.event[existingEventIndex]
            existingEvents.events.event[existingEventIndex] = {
                ...existingEvents.events.event[existingEventIndex],
                nominal: [`${parseInt(nominal[0]) + 1}`],
                min: [`${parseInt(min[0]) + 1}`],
                max: [`${parseInt(max[0]) + 1}`]
            }
        } else {
            existingEvents.events.event = [
                {
                    $: { name },
                    nominal: [ '1' ],
                    min: [ '1' ],
                    max: [ '1' ],
                    lifetime: [ '3888000' ],
                    restock: [ '0' ],
                    saferadius: [ '0' ],
                    distanceradius: [ '0' ],
                    cleanupradius: [ '1000' ],
                    flags: [ { '$': { deletable: '0', init_random: '0', remove_damaged: '0' } } ],
                    position: [ 'fixed' ],
                    limit: [ 'child' ],
                    active: [ '1' ],
                    children: [
                        {
                            child: [
                                {
                                    '$': {
                                        lootmax: '0',
                                        lootmin: '0',
                                        max: '1',
                                        min: '1',
                                        type: className
                                    }
                                }
                            ]
                        } 
                    ]
                },
                ...existingEvents.events.event
            ]
        }
    })

    const builder = new xml2js.Builder()
    const existingEventsXml = builder.buildObject({
        ...existingEvents,
    })
    console.log(existingEventsXml.substr(0,500))
    console.log(getDayZXMLFilesWindowsPath(`db\\events.xml`))
    fs.writeFileSync(`${getDayZXMLFilesWindowsPath(`db\\events.xml`)}`, existingEventsXml, 'utf8')
    return Promise.resolve()
}

const mapgrouppos = async (newEventSpawns) => {
    const mapgroupposXmlString = getFileAsString(`mapgrouppos.xml`)
    const existingMapgroupposs = await getJsFromXml(mapgroupposXmlString)

    const filtered = newEventSpawns
        .filter(e => e.className.match('Container'))

    for (let i = 0; i <= filtered.length - 1; i++) {
        const newEventSpawn = filtered[i]
        const { x, z, a, r, p, y, className } = newEventSpawn
        // console.log(newEventSpawn)
        const [groupConfig] = [
            [
                `1Land_Container_1Aoh`,
                `AllPistols_1`,
                ['SmallCaliburMags_2', 'SmallCaliburMags_2', 'SmallCaliburAmmo_1']
            ],
            [
                `2Land_Container_1Bo`,
                `PoliceShotgunsAndAutos_1`,
                ['SmallCaliburMags_1', 'SmallCaliburMags_1', 'SmallCaliburAmmo_1']
            ],
            [
                `3Land_Container_1Mo`,
                'HuntingRifleWeapons_1',
                ['Scopes_1', 'LargeCaliburAmmoBoxes_1', 'LargeCaliburAmmo_1'],
            ],
            [
                `4Land_Container_1Moh`,
                `MilitaryRifleWeapons_1`,
                ['SniperMags_1', 'SniperMags_1', 'LargeCaliburAmmoBoxes_1', 'LargeCaliburAmmo_1']
            ],
            [
                `5Land_Container_1Aoh`,
                `MilitaryAutoWeapons_1`,
                ['AutoMilMags_1', 'AutoMilMags_1', 'LargeCaliburAmmo_1']
            ],
            [
                `6Land_Container_1Bo`,
                `QuickClothes_1`,
                []
            ],
            [
                `7Land_Container_1Mo`,
                `QuickSurvive_1`,
                []
            ],
            [
                `8Land_Container_1Moh`,
                `AllPistols_1`,
                ['SmallCaliburMags_2', 'SmallCaliburMags_2', 'SmallCaliburAmmo_1']
            ],
            [
                `9Land_Container_1Aoh`,
                `PoliceShotgunsAndAutos_1`,
                ['SmallCaliburMags_1', 'SmallCaliburMags_1', 'SmallCaliburAmmo_1']
            ],
            [
                `10Land_Container_1Bo`,
                'HuntingRifleWeapons_1',
                ['Scopes_1', 'LargeCaliburAmmoBoxes_1', 'LargeCaliburAmmo_1'],
            ],
            [
                `11Land_Container_1Mo`,
                `MilitaryRifleWeapons_1`,
                ['SniperMags_1', 'SniperMags_1', 'LargeCaliburAmmoBoxes_1', 'LargeCaliburAmmo_1']
            ],
            [
                `12Land_Container_1Moh`,
                `MilitaryAutoWeapons_1`,
                ['AutoMilMags_1', 'AutoMilMags_1', 'LargeCaliburAmmo_1']
            ],
            [
                `13Land_Container_1Aoh`,
                `QuickClothes_1`,
                []
            ],
            [
                `14Land_Container_1Bo`,
                `QuickSurvive_1`,
                []
            ],
            // [
            //     `BookBible`,
            //     `AllPistols_1`,
            //     ['SmallCaliburMags_2', 'SmallCaliburMags_2', 'SmallCaliburAmmo_1']
            // ],
            // [
            //     `BookTheWarOfTheWorlds`,
            //     `PoliceShotgunsAndAutos_1`,
            //     ['SmallCaliburMags_1', 'SmallCaliburMags_1', 'SmallCaliburAmmo_1']
            // ],
            // [
            //     `BookTheMetamorphosis`,
            //     'HuntingRifleWeapons_1',
            //     ['Scopes_1', 'LargeCaliburAmmoBoxes_1', 'LargeCaliburAmmo_1'],
            // ],
            // [
            //     `BookCrimeAndPunishment`,
            //     `MilitaryRifleWeapons_1`,
            //     ['SniperMags_1', 'SniperMags_1', 'LargeCaliburAmmoBoxes_1', 'LargeCaliburAmmo_1']
            // ],
            // [
            //     `BookAroundTheWorldIn80Days`,
            //     `MilitaryAutoWeapons_1`,
            //     ['AutoMilMags_1', 'AutoMilMags_1', 'LargeCaliburAmmo_1']
            // ],
            // [
            //     `BookTheRaven`,
            //     `QuickClothes_1`,
            //     []
            // ],
            // [
            //     `BookRobinsonCrusoe`,
            //     `QuickSurvive_1`,
            //     []
            // ]
        ].filter(gc => {
            // console.log(className, gc[0], className.match(gc[0]))
            return className === gc[0]
        })
        // console.log(groupConfig)
        const [prefix, socketName, socketAdjacencies] = groupConfig
        const packageXmlStringAlpha = getPackageXml(
            className,
            [ [x, z, y] ],
            socketName,
            socketAdjacencies,
            a
        )
        const packageXmlString = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
            <root>
                ${packageXmlStringAlpha}
            </root>
        `
        const jsFromXml = await getJsFromXml(packageXmlString)
        const groups = jsFromXml.root.group
        // console.log(groups)
        // console.log(existingMapgroupposs.map.group[0])
        existingMapgroupposs.map.group = [
            ...groups,
            ...existingMapgroupposs.map.group
        ]
    }

    const builder = new xml2js.Builder()
    const xml = builder.buildObject({
        ...existingMapgroupposs,
    })
    console.log(xml.substr(0,500))
    console.log(getDayZXMLFilesWindowsPath(`mapgrouppos.xml`))
    fs.writeFileSync(`${getDayZXMLFilesWindowsPath(`mapgrouppos.xml`)}`, xml, 'utf8')
    return Promise.resolve()
}

module.exports = {
    dayzXmlFilesPath,
    getDayZXMLFilesWindowsPath,
    getFileAsString,
    getJsFromXml,
    getGroup,
    getGroups,
    getPos,
    getEventSpawn,
    getEvent,
    getEventsXml,
    getGroupsXml,
    getPackageXml,
    f,
    spawnObjectMap,
    eventSpawns,
    getClassType,
    events,
    mapgrouppos,
}
