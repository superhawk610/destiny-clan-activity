var Traveler = require('the-traveler').default;
const Enums = require('the-traveler/build/enums')

const traveler = new Traveler({
    apikey: 'd78cb29fa3ab4ff8bacc5be25a96be9f',
    userAgent: 'chrome', //used to identify your request to the API
});

//Access the enums (example componentType profiles)
var profilesType = Enums.ComponentType.Profiles;

// dump clan list
(async () => {
    const player = await traveler.searchDestinyPlayer('4', 'ferenz%2311349');
    const id = player.Response[0].membershipId;
    console.log(id);
})()