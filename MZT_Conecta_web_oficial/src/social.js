// Datos sociales reales en memoria (sin usar localStorage para información compartida).
let people={},comments={},follows=[],votes=[];
export function setSocialSnapshot(snapshot){
 people=Object.fromEntries(snapshot.people.map(p=>[p.id,p]));
 comments={};for(const row of snapshot.comments){(comments[row.postId]??=[]).push(row);}
 for(const rows of Object.values(comments))rows.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 follows=snapshot.follows;votes=snapshot.votes;
}
export function clearSocialSnapshot(){people={};comments={};follows=[];votes=[];}
export function authorIdFor(item){return item.ownerUserId || '';}
export function personFor(id){return people[id] || null;}
export function syncPerson(id,name,profile){
 if(!id)return;
 people[id]={id,name:String(name||'Usuario').slice(0,40),username:String(profile?.username||'ciudadano'),
 bio:String(profile?.bio||'').slice(0,160),avatar:profile?.avatar||null,cover:profile?.cover||null};
}
export function followersOf(id){return follows.filter(x=>x.to===id).length;}
export function followingOf(id){return follows.filter(x=>x.from===id).length;}
export function isFollowing(from,to){return follows.some(x=>x.from===from&&x.to===to);}
export function commentsFor(id){return comments[id]||[];}
export function countComments(id){return commentsFor(id).length;}
export function voteCountFor(id){return votes.filter(x=>x.postId===id).length;}
export function isVotedBy(postId,userId){return votes.some(x=>x.postId===postId&&x.userId===userId);}
export function localPersonIds(){return Object.keys(people);}
