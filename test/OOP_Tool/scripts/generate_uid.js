// gets a unique uid (most of the time)

function generate_uid() {
    const d = new Date();
    let time = d.getTime();
    let rand1 = Math.floor(Math.random() * 1000);
    let rand2 = Math.floor(Math.random() * 1000);
    return time.toString() + "-" + rand1.toString() + rand2.toString();
}